import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import {
  createPuntoDeVentaHandler,
} from '@/features/puntos-venta/api/handlers';

export async function getPuntosDeVentaHandler(req: NextRequest) {
  try {
    const authResult = await authenticateUser(req)
    if ('status' in authResult) return authResult as Response
    const user = authResult.user
    const puntosDeVenta = await prisma.puntoDeVenta.findMany({
      where: { tenantId: user.tenantId },
      include: { listaPrecio: true },
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json(puntosDeVenta)
  } catch (error) {
    console.error("Error al obtener puntos de venta:", error)
    return NextResponse.json({ error: "Error al obtener puntos de venta" }, { status: 500 })
  }
}

export const GET = getPuntosDeVentaHandler;
export const POST = createPuntoDeVentaHandler;
