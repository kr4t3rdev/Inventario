import type { AuthenticatedUser } from '@/lib/auth-middleware'

export { createPuntoDeVentaHandler, getPuntoDeVentaByIdHandler, updatePuntoDeVentaHandler, deletePuntoDeVentaHandler } from './api/handlers';

export async function getPuntosDeVentaHandler(request: import('next/server').NextRequest) {
  const { prisma } = await import('@/lib/prisma')
  const { requireTenant } = await import('@/lib/services/tenant-scope')
  const { authenticateUser } = await import('@/lib/auth-middleware')
  const { NextResponse } = await import('next/server')
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const user = authResult.user as AuthenticatedUser
    const tenantId = requireTenant(user)
    const puntosDeVenta = await prisma.puntoDeVenta.findMany({
      where: { tenantId },
      include: { listaPrecio: true },
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json({ puntosDeVenta })
  } catch (error) {
    console.error('Error al obtener puntos de venta:', error)
    const { NextResponse } = await import('next/server')
    return NextResponse.json({ error: 'Error al obtener puntos de venta' }, { status: 500 })
  }
}

export { puntosDeVentaApi, useGetPuntosDeVentaQuery, useGetPuntoDeVentaQuery, useAddPuntoDeVentaMutation, useUpdatePuntoDeVentaMutation, useDeletePuntoDeVentaMutation } from './api/puntosDeVentaApi';
export type { PuntoDeVenta } from './types';
