import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-middleware';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { expirarOfertasVencidas } from '@/features/ofertas/services/expiracion-ofertas-service';

async function handler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user: AuthenticatedUser,
) {
  const { id } = await params;
  if (!user.tenantId) {
    return NextResponse.json({ error: 'Tenant no identificado' }, { status: 403 });
  }
  await expirarOfertasVencidas(user.tenantId);

  const oferta = await prisma.oferta.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      cliente: true,
      items: {
        include: {
          producto: { select: { id: true, nombre: true, precioVenta: true, codigoInterno: true } },
          servicio: { select: { servicioId: true, nombre: true, precio: true } },
        },
      },
    },
  });

  if (!oferta) {
    return NextResponse.json({ error: 'Oferta no encontrada' }, { status: 404 });
  }

  const serialized = {
    ...oferta,
    subtotal: Number(oferta.subtotal),
    total: Number(oferta.total),
    impuestos: Number(oferta.impuestos ?? 0),
  };

  return NextResponse.json(serialized);
}

export const GET = withAuth(handler);
