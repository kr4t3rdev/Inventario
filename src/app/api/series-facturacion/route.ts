import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'

interface SerieInput {
  prefijo: string
  descripcion: string
  activa?: boolean
  esPorDefecto?: boolean
}

/**
 * @description GET /api/series-facturacion - Lista las series activas del tenant.
 * @param {NextRequest} _request - Request HTTP.
 * @returns {Promise<NextResponse>} Lista de series de facturación.
 */
export const GET = withAuthGet(async (_request: NextRequest, _context: any, user: { userId: string; tenantId?: string }) => {
  try {
    const tenantId = user.tenantId
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant no identificado' }, { status: 400 })
    }

    const series = await prisma.serieFacturacion.findMany({
      where: { tenantId },
      orderBy: { esPorDefecto: 'desc' },
      select: {
        serieId: true,
        prefijo: true,
        descripcion: true,
        consecutivo: true,
        activa: true,
        esPorDefecto: true,
        createdAt: true,
      },
    })

    return NextResponse.json(series)
  } catch (error) {
    console.error('Error al cargar series de facturación:', error)
    return NextResponse.json({ error: 'Error al cargar series' }, { status: 500 })
  }
})

/**
 * @description POST /api/series-facturacion - Crea una nueva serie de facturación.
 * @param {NextRequest} request - Request HTTP.
 * @returns {Promise<NextResponse>} Serie creada.
 */
export const POST = withAuthPost(async (request: NextRequest, _context: any, user: { userId: string; tenantId?: string }) => {
  try {
    const tenantId = user.tenantId
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant no identificado' }, { status: 400 })
    }

    const body: SerieInput = await request.json()

    if (!body.prefijo || !body.descripcion) {
      return NextResponse.json({ error: 'prefijo y descripcion son requeridos' }, { status: 400 })
    }

    // Verificar duplicado
    const exists = await prisma.serieFacturacion.findFirst({
      where: { prefijo: body.prefijo, tenantId },
    })
    if (exists) {
      return NextResponse.json({ error: `Ya existe una serie con el prefijo '${body.prefijo}'` }, { status: 409 })
    }

    // Si es por defecto, desmarcar otras
    if (body.esPorDefecto) {
      await prisma.serieFacturacion.updateMany({
        where: { esPorDefecto: true, tenantId },
        data: { esPorDefecto: false },
      })
    }

    const serie = await prisma.serieFacturacion.create({
      data: {
        prefijo: body.prefijo,
        descripcion: body.descripcion,
        activa: body.activa ?? true,
        esPorDefecto: body.esPorDefecto ?? false,
        tenantId,
      },
    })

    return NextResponse.json(serie, { status: 201 })
  } catch (error) {
    console.error('Error al crear serie de facturación:', error)
    return NextResponse.json({ error: 'Error al crear serie' }, { status: 500 })
  }
})
